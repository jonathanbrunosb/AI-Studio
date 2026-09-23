import { copyFileSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { loginAs, sql, unique, users } from "./helpers";
import { approveAsReviewer, createCommunique, openEditorAndPersist, submitForReview } from "./journeys";

/** Módulo de importação do Portal (repositório portal-contabilidade), usado para validar o pacote como o portal fará. */
const portalModule = path.resolve(process.env.PORTAL_REPO ?? "../portal-contabilidade", "js/ai-studio-import.js");
const publicKey = () => readFileSync(".env.e2e", "utf8").match(/^E2E_PORTAL_PUBLIC_KEY=(.+)$/m)?.[1] ?? "";

async function approvedCommunique(page: Page, title: string) {
  await loginAs(page, users.editor);
  const contentId = await createCommunique(page, title);
  await openEditorAndPersist(page, contentId, sql);
  await submitForReview(page, contentId, sql);
  await loginAs(page, users.approver);
  await approveAsReviewer(page, contentId, sql);
  return contentId;
}

async function prepareAndDownload(page: Page, title: string, button = /Preparar publicação|Preparar atualização/) {
  await page.goto("/publicacoes");
  const row = page.getByRole("row").filter({ hasText: title });
  await row.getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog", { name: "Preparar publicação" });
  await dialog.getByLabel("Conferi título, categoria, versão, destino e pré-visualização.").check();
  await dialog.getByRole("button", { name: "Gerar pacote" }).click();
  await expect(dialog.getByRole("status")).toContainText(/pacote/i, { timeout: 30_000 });
  // Baixa pelo mesmo endereço do link, com a sessão do usuário (cookies do navegador).
  const href = await dialog.getByRole("link", { name: "Baixar pacote ZIP" }).getAttribute("href");
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("zip");
  expect(response.headers()["content-disposition"] ?? "").toContain("attachment");
  return response.body();
}

test("publicação: pacote assinado validado pelo módulo do portal, confirmação pelo administrador e nova versão", async ({ page }) => {
  test.skip(!existsSync(portalModule), `Módulo do portal não encontrado em ${portalModule} (defina PORTAL_REPO).`);
  // O repositório do portal não declara "type": "module"; a cópia .mjs permite importar o módulo ESM original sem alterá-lo.
  const moduleCopy = path.join(mkdtempSync(path.join(os.tmpdir(), "portal-")), "ai-studio-import.mjs");
  copyFileSync(portalModule, moduleCopy);
  const portal = await import(pathToFileURL(moduleCopy).href);
  const title = unique("Publicação E2E");
  const contentId = await approvedCommunique(page, title);

  // Aprovador não prepara publicação.
  await page.goto("/publicacoes");
  await expect(page.getByRole("row").filter({ hasText: title }).getByRole("button", { name: "Preparar publicação" })).toHaveCount(0);

  // Autor prepara e baixa o pacote.
  await loginAs(page, users.editor);
  const zip = await prepareAndDownload(page, title);
  const files: Map<string, Uint8Array> = await portal.readZip(zip);
  const check = await portal.validatePackage(files, { publicKeySpki: publicKey(), requireSignature: true });
  console.log(`pacote: ${zip.length} bytes, arquivos=${[...files.keys()].join(",")}, origem=${check.origin}, erros=${check.errors.length}`);
  expect(check.errors).toEqual([]);
  expect(check.origin).toBe("verified");
  expect(check.manifest.content_id).toBe(contentId);

  // Adulteração: 1 byte da imagem alterado ⇒ o portal recusa.
  const tampered = new Map(files);
  const imageName = check.manifest.image.filename as string;
  const image = new Uint8Array(files.get(imageName)!); image[image.length - 20] ^= 0xff;
  tampered.set(imageName, image);
  const rejected = await portal.validatePackage(tampered, { publicKeySpki: publicKey(), requireSignature: true });
  expect(rejected.ok).toBe(false);
  // Assinatura de outra chave ⇒ origem inválida.
  const other = await portal.validatePackage(files, { publicKeySpki: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEyVhVwDTe0BoS1DKZ0MV6xtVQWXw0hzFNmRGqKIUnApeVK4J9Oa9QGjWNg5c4nnB/GTOkHGyJEwO2ZxyMR0VJeA==", requireSignature: true });
  expect(other.ok).toBe(false);

  const pubStatus = () => sql(`select status from publication_exports where content_id='${contentId}' order by created_at desc limit 1`);
  expect(["prepared", "exported"]).toContain(pubStatus());
  expect(sql(`select status from contents where id='${contentId}'`)).toBe("approved");

  // Editor não confirma publicação (controle ausente e banco recusa).
  await page.goto("/publicacoes");
  await expect(page.getByRole("row").filter({ hasText: title }).getByRole("button", { name: "Confirmar publicação" })).toHaveCount(0);

  // Administrador confirma após verificar no portal.
  await loginAs(page, users.admin);
  await page.goto("/publicacoes");
  await page.getByRole("row").filter({ hasText: title }).getByRole("button", { name: "Confirmar publicação" }).click();
  const confirm = page.getByRole("dialog");
  await confirm.getByLabel("Identificador no portal (opcional)").fill(`ais-e2e-${contentId.slice(0, 8)}`);
  await confirm.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect.poll(pubStatus).toBe("published");
  expect(sql(`select status from contents where id='${contentId}'`)).toBe("published");
  const firstPublication = sql(`select id from publication_exports where content_id='${contentId}' and status='published'`);

  // Nova versão a partir do publicado: a publicação anterior permanece até a nova ser confirmada.
  await loginAs(page, users.editor);
  await page.goto(`/studio?id=${contentId}`);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Criar nova versão" }).click();
  await expect.poll(() => sql(`select status from contents where id='${contentId}'`)).toBe("draft");
  expect(sql(`select status from publication_exports where id='${firstPublication}'`)).toBe("published");
  const history = sql(`select count(*) from publication_events where content_id='${contentId}'`);
  console.log(`eventos de publicação registrados: ${history}`);
  expect(Number(history)).toBeGreaterThanOrEqual(2);
});
