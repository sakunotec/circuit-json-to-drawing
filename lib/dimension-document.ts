import {
  drawing_dimension,
  type CadComponent,
  type DrawingDimension,
  type DrawingPartView,
  type SourceGroup,
} from "circuit-json"
import type { DrawingDocument } from "./types"

/** Validate dimension intent and owning CAD selections before scene loading.
 * Native model readers own edge names, geometry and topology; Circuit JSON
 * contains only the model association and an opaque feature name.
 */
export function parseDrawingDimensions(
  input: DrawingDocument,
  views: DrawingPartView[],
) {
  const dimensions: DrawingDimension[] = []
  const dimensionIds = new Set<DrawingDimension["drawing_dimension_id"]>()
  const cadComponents = new Map<
    CadComponent["cad_component_id"],
    Pick<CadComponent, "source_component_id">
  >()
  const sourceGroups = new Map<
    SourceGroup["source_group_id"],
    SourceGroup["parent_source_group_id"]
  >()
  const componentGroups = new Map<
    CadComponent["source_component_id"],
    SourceGroup["source_group_id"]
  >()
  if (!input.some((record) => record.type === "drawing_dimension"))
    return dimensions
  for (const record of input) {
    if (record.type === "drawing_dimension") {
      const dimension = drawing_dimension.parse(record)
      if (dimensionIds.has(dimension.drawing_dimension_id))
        throw new Error("Duplicate drawing dimension")
      dimensionIds.add(dimension.drawing_dimension_id)
      dimensions.push(dimension)
    } else if (record.type === "cad_component") {
      if (
        typeof record.cad_component_id !== "string" ||
        typeof record.source_component_id !== "string"
      )
        throw new Error(
          "Drawing CAD parts require CAD and source component references",
        )
      if (cadComponents.has(record.cad_component_id))
        throw new Error("Duplicate CAD part reference in drawing document")
      cadComponents.set(record.cad_component_id, {
        source_component_id: record.source_component_id,
      })
    } else if (
      record.type === "source_group" &&
      typeof record.source_group_id === "string"
    ) {
      sourceGroups.set(
        record.source_group_id,
        typeof record.parent_source_group_id === "string"
          ? record.parent_source_group_id
          : undefined,
      )
    } else if (
      record.type === "source_component" &&
      typeof record.source_component_id === "string" &&
      typeof record.source_group_id === "string"
    ) {
      componentGroups.set(record.source_component_id, record.source_group_id)
    }
  }
  for (const dimension of dimensions) {
    const view = views.find(
      (view) => view.drawing_part_view_id === dimension.drawing_part_view_id,
    )
    if (!view)
      throw new Error("Drawing dimension references a missing part view")
    if (dimension.measurement !== "edge") continue
    const owner = cadComponents.get(dimension.cad_component_id!)
    if (!owner) throw new Error(`Dimension references a missing CAD component`)
    const sourceId = owner.source_component_id
    if (
      view.source_component_ids &&
      !view.source_component_ids.includes(sourceId)
    )
      throw new Error(
        `Named edge "${dimension.edge_name}" does not belong to the geometry selected by view "${view.name ?? "unnamed view"}"`,
      )
    if (view.source_group_id) {
      let group = componentGroups.get(sourceId)
      const visited = new Set<SourceGroup["source_group_id"]>()
      while (group && group !== view.source_group_id && !visited.has(group)) {
        visited.add(group)
        group = sourceGroups.get(group)
      }
      if (group !== view.source_group_id)
        throw new Error(
          `Named edge "${dimension.edge_name}" does not belong to the group selected by view "${view.name ?? "unnamed view"}"`,
        )
    }
  }
  return dimensions
}
