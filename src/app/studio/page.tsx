import { ChevronLeft, Save } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StudioForm } from "@/components/studio/studio-form";
import { CreativeCanvas } from "@/components/studio/creative-canvas";
import { ImageGeneratorMock } from "@/components/studio/image-generator-mock";

export default function StudioPage() {
  return <div><PageHeader eyebrow="Workspace criativo" title="Estúdio de Criação" description="Estruture o conteúdo, acompanhe a peça visual e prepare referências para produção." actions={<><button className="secondary-button"><ChevronLeft size={16} />Voltar</button><button className="primary-button"><Save size={16} />Salvar rascunho</button></>} /><div className="grid min-w-0 items-start gap-5 2xl:grid-cols-[minmax(275px,.8fr)_minmax(440px,1.5fr)_minmax(270px,.8fr)]"><SectionCard title="Conteúdo" description="Informações editoriais da peça"><StudioForm /></SectionCard><SectionCard title="Peça em construção" description="Visualização aproximada do resultado"><CreativeCanvas /></SectionCard><SectionCard title="Imagem de apoio" description="Configure a futura geração visual"><ImageGeneratorMock /></SectionCard></div></div>;
}
