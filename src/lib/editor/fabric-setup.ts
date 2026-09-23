import { FabricObject } from "fabric";

/**
 * O Fabric 7 passou a usar origem no centro (originX/originY = "center"). Todo o posicionamento do AI Studio
 * (modelos iniciais, textos, formas, imagens e plano de fundo) usa o canto superior esquerdo, como no Fabric 6.
 * Objetos já serializados carregam a própria origem no JSON e continuam renderizando como foram salvos.
 */
FabricObject.ownDefaults.originX = "left";
FabricObject.ownDefaults.originY = "top";

export { FabricObject };
