import { gunzipSync } from "node:zlib"
import { readFile } from "node:fs/promises"
import { expect, test } from "bun:test"
import "bun-match-svg"
import {
  createSceneFromGLTF,
  loadGLTFWithResourcesFromURL,
  type GLTFScene,
} from "poppygl"
import { convertCircuitJsonToDrawingPages } from "../lib"
import { page, view } from "./fixtures/drawings"

test("configured part views render supplied geometry without authored image records", async () => {
  const bytes = new Uint8Array(
    gunzipSync(
      await readFile(new URL("./fixtures/enclosure.glb.gz", import.meta.url)),
    ),
  )
  const input = [
    { ...page(), name: 'Enclosure <A> & "B"' },
    {
      ...view("iso"),
      name: "ISOMETRIC",
      source_component_ids: ["housing"],
      center: { x: -48, y: 10 },
      width: 85,
      height: 90,
    },
    {
      ...view("plan", "drawing_1", "z_positive"),
      name: "PLAN",
      source_component_ids: ["housing"],
      center: { x: 48, y: 10 },
      width: 85,
      height: 90,
    },
  ]
  const original = JSON.stringify(input)
  let scenePromise: Promise<GLTFScene> | undefined,
    requests = 0,
    resolutions = 0
  const pages = await convertCircuitJsonToDrawingPages(input, {
    resolveScene: async (part, document) => {
      resolutions++
      expect(part.source_component_ids).toEqual(["housing"])
      expect(document).toBe(input)
      // Caller-owned model cache. No model/image URL is stored in drawing configuration.
      scenePromise ??= loadGLTFWithResourcesFromURL(
        "https://example.test/model.glb",
        {
          fetchImpl: async () => {
            requests++
            return {
              ok: true,
              status: 200,
              statusText: "OK",
              arrayBuffer: async () =>
                bytes.buffer.slice(
                  bytes.byteOffset,
                  bytes.byteOffset + bytes.byteLength,
                ) as ArrayBuffer,
            }
          },
        },
      ).then(({ gltf, resources }) => createSceneFromGLTF(gltf, resources))
      return scenePromise
    },
  })
  expect(requests).toBe(1)
  expect(resolutions).toBe(2)
  expect(pages).toHaveLength(1)
  expect(Object.keys(pages[0]!)).toEqual(["drawingPageId", "svg"])
  expect(JSON.stringify(input)).toBe(original)
  expect(original).not.toContain("url")
  const svg = pages[0]!.svg
  expect(svg).toContain("Enclosure &lt;A&gt; &amp; &quot;B&quot;")
  expect(svg).not.toContain('href="https:')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
