import { gunzipSync } from "node:zlib"
import { expect, test } from "bun:test"
import "bun-match-svg"
import { convertCircuitJsonToDrawingArtifacts } from "../lib"
import { sheet, view } from "./fixtures/drawings"
import { readFile } from "node:fs/promises"
import { drawing_artifact } from "circuit-json"

test("a GLB URL produces a self-contained sheet and view artifacts with one model fetch", async () => {
  const bytes = new Uint8Array(
    gunzipSync(
      await readFile(new URL("./fixtures/enclosure.glb.gz", import.meta.url)),
    ),
  )
  const paper = {
    ...sheet(),
    name: 'Enclosure <A> & "B"',
    model_glb_url: "https://example.test/enclosure.glb",
  }
  let requests = 0
  const input = [
    paper,
    {
      ...view("iso"),
      name: "ISOMETRIC",
      center: { x: -48, y: 10 },
      width: 85,
      height: 90,
    },
    {
      ...view("plan", "drawing_1", "z_positive"),
      name: "PLAN",
      center: { x: 48, y: 10 },
      width: 85,
      height: 90,
    },
  ]
  const original = JSON.stringify(input)
  const artifacts = await convertCircuitJsonToDrawingArtifacts(input, {
    fetchImpl: async (url) => {
      expect(url).toBe(paper.model_glb_url)
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
  })
  expect(requests).toBe(1)
  expect(artifacts).toHaveLength(3)
  for (const artifact of artifacts)
    expect(drawing_artifact.parse(artifact.element)).toEqual(artifact.element)
  expect(JSON.stringify(input)).toBe(original)
  const svg = artifacts.find((a) => a.element.format === "svg")!
    .content as string
  expect(svg).toContain("Enclosure &lt;A&gt; &amp; &quot;B&quot;")
  expect(svg).toContain("data:image/png;base64,")
  expect(svg).not.toContain('href="https:')
  await expect(svg).toMatchSvgSnapshot(import.meta.path)
})
