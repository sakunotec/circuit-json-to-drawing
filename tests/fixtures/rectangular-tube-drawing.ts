import { booleans, primitives, extrusions } from "@jscad/modeling"
import { mp } from "@tscircuit/modelprinter"
import type {
  CadNamedEdgeInput,
  DrawingDimensionInput,
  DrawingPartView,
} from "circuit-json"
import { cadScene } from "./models"

/** Open stock tube in model-local CAD mm (+Z up), ends at Z=0 and Z=length.
 * This fixture's placement is identity: modelprinter reference points therefore
 * become CAD world-space points without an additional transform.
 */
export function rectangularTubeDrawing(
  width = 40,
  height = 20,
  wall = 3,
  length = 80,
  outerRadius = 0,
) {
  const metadata = mp
    .string(
      `rectangulartube_w${width}mm_h${height}mm_wall${wall}mm_l${length}mm_outerr${outerRadius}mm`,
    )
    .drawing()!
  const crossSection = outerRadius
    ? primitives.roundedRectangle({
        size: [width, height],
        roundRadius: outerRadius,
        segments: 32,
      })
    : primitives.rectangle({ size: [width, height] })
  const scene = cadScene(
    extrusions.extrudeLinear(
      { height: length },
      booleans.subtract(
        crossSection,
        primitives.rectangle({ size: [width - 2 * wall, height - 2 * wall] }),
      ),
    ),
  )
  const page = {
    type: "drawing_page" as const,
    drawing_page_id: "tube_sheet",
    name: "Rectangular stock tube",
    page_size: "iso_a4" as const,
    orientation: "landscape" as const,
    width: 297,
    height: 210,
  }
  const cad = {
    type: "cad_component",
    cad_component_id: "cad_tube",
    source_component_id: "source_tube",
  }
  const edges: CadNamedEdgeInput[] = metadata.namedEdges.map((edge) => ({
    type: "cad_named_edge",
    cad_named_edge_id: `edge_${edge.name}`,
    cad_component_id: cad.cad_component_id,
    ...edge,
  }))
  const views: DrawingPartView[] = [
    {
      type: "drawing_part_view",
      drawing_part_view_id: "end",
      drawing_page_id: page.drawing_page_id,
      name: "END PROFILE",
      direction: "z_positive",
      source_component_ids: [cad.source_component_id],
      center: { x: -85, y: 35 },
      width: 90,
      height: 90,
    },
    {
      type: "drawing_part_view",
      drawing_part_view_id: "side",
      drawing_page_id: page.drawing_page_id,
      name: "SIDE ELEVATION",
      direction: "y_negative",
      source_component_ids: [cad.source_component_id],
      center: { x: 5, y: 20 },
      width: 70,
      height: 140,
    },
    {
      type: "drawing_part_view",
      drawing_part_view_id: "iso",
      drawing_page_id: page.drawing_page_id,
      name: "ISOMETRIC",
      direction: "isometric",
      source_component_ids: [cad.source_component_id],
      center: { x: 100, y: 20 },
      width: 75,
      height: 115,
    },
  ]
  const dimensions: DrawingDimensionInput[] = metadata.views.flatMap((view) =>
    view.dimensions.map(
      ({ edgeRef, widthOfView, heightOfView, ...dimension }) => {
        const measurement = widthOfView
          ? "view_width"
          : heightOfView
            ? "view_height"
            : "edge"
        return {
          type: "drawing_dimension" as const,
          drawing_dimension_id: `${view.name}_${edgeRef ?? measurement}`,
          drawing_part_view_id: view.name,
          measurement,
          ...(edgeRef ? { cad_named_edge_id: `edge_${edgeRef.slice(1)}` } : {}),
          ...dimension,
        }
      },
    ),
  )
  const block = {
    type: "drawing_page_title_block",
    drawing_page_title_block_id: "tube_title",
    drawing_page_id: page.drawing_page_id,
    title: "RECTANGULAR TUBE — DIMENSIONS IN mm",
    identification_number: "STK-040-020-003",
    revision_index: "A",
    legal_owner: "tscircuit",
    creator: "Modelprinter",
    sheet_number: 1,
    number_of_sheets: 1,
  }
  return {
    input: [page, cad, ...edges, ...views, ...dimensions, block],
    scene,
    edges,
    views,
    dimensions,
    page,
    metadata,
  }
}
