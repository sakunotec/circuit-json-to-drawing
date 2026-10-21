import { geometries, primitives, booleans } from "@jscad/modeling"
import { cadToGltf } from "../../lib"
import type { GLTFScene } from "poppygl"

export function cadScene(
  shape = primitives.cuboid({ size: [20, 20, 20] }),
): GLTFScene {
  const positions: number[] = []
  for (const poly of geometries.geom3.toPolygons(shape))
    for (let i = 1; i + 1 < poly.vertices.length; i++)
      for (const point of [
        poly.vertices[0]!,
        poly.vertices[i]!,
        poly.vertices[i + 1]!,
      ])
        positions.push(...cadToGltf(point as [number, number, number]))
  return {
    gltf: { asset: { version: "2.0" } },
    drawCalls: [
      {
        positions: new Float32Array(positions),
        indices: null,
        normals: null,
        uvs: null,
        model: new Float32Array([
          1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
        ]),
        material: {
          baseColorFactor: [0.1, 0.4, 0.8, 1],
          baseColorTexture: null,
        },
      },
    ],
  }
}
export function hollowTubeScene() {
  return cadScene(
    booleans.subtract(
      primitives.cylinder({
        center: [13, -7, 5],
        radius: 12,
        height: 30,
        segments: 32,
      }),
      primitives.cylinder({
        center: [13, -7, 5],
        radius: 8,
        height: 32,
        segments: 32,
      }),
    ),
  )
}
export function asymmetricScene() {
  return cadScene(
    booleans.union(
      primitives.cuboid({ center: [9, -3, 2], size: [30, 12, 4] }),
      primitives.cuboid({ center: [-2, -3, 12], size: [8, 12, 20] }),
      primitives.cuboid({ center: [15, -10, 5], size: [10, 6, 10] }),
    ),
  )
}
