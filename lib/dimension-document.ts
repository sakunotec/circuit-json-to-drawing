import {
  cad_named_edge,
  drawing_dimension,
  type CadNamedEdge,
  type CadComponent,
  type DrawingDimension,
  type DrawingPartView,
  type SourceGroup,
} from "circuit-json"
import type { DrawingDocument } from "./types"

/** Parse analytic reference segments once, before scene loading. They are authored
 * model-defined edges in CAD world space, not mesh indices or a B-rep edge registry.
 */
export function parseDrawingDimensions(
  input: DrawingDocument,
  views: DrawingPartView[],
) {
  const edges = new Map<CadNamedEdge["cad_named_edge_id"], CadNamedEdge>()
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
  const edgeNames = new Set<string>()
  if (
    !input.some(
      (record) =>
        record.type === "drawing_dimension" || record.type === "cad_named_edge",
    )
  )
    return { edges, dimensions }
  for (const record of input) {
    if (record.type === "cad_named_edge") {
      const edge = cad_named_edge.parse(record)
      if (edges.has(edge.cad_named_edge_id))
        throw new Error(`Duplicate named edge "${edge.name}"`)
      const key = JSON.stringify([edge.cad_component_id, edge.name])
      if (edgeNames.has(key))
        throw new Error(
          `Named edge "${edge.name}" is ambiguous within its CAD part`,
        )
      edgeNames.add(key)
      edges.set(edge.cad_named_edge_id, edge)
    } else if (record.type === "drawing_dimension") {
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
  for (const edge of edges.values())
    if (!cadComponents.has(edge.cad_component_id))
      throw new Error(`Named edge "${edge.name}" references a missing CAD part`)
  for (const dimension of dimensions) {
    const view = views.find(
      (view) => view.drawing_part_view_id === dimension.drawing_part_view_id,
    )
    if (!view)
      throw new Error("Drawing dimension references a missing part view")
    if (dimension.measurement !== "edge") continue
    const edge = edges.get(dimension.cad_named_edge_id!)
    if (!edge)
      throw new Error(
        `Dimension in view "${view.name ?? "unnamed view"}" references a missing named edge`,
      )
    const sourceId = cadComponents.get(
      edge.cad_component_id,
    )!.source_component_id
    if (
      view.source_component_ids &&
      !view.source_component_ids.includes(sourceId)
    )
      throw new Error(
        `Named edge "${edge.name}" does not belong to the geometry selected by view "${view.name ?? "unnamed view"}"`,
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
          `Named edge "${edge.name}" does not belong to the group selected by view "${view.name ?? "unnamed view"}"`,
        )
    }
  }
  return { edges, dimensions }
}
