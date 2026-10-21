# Drawing converter guidance

Follow tscircuit/handbook guides/bootstrapping-repos.md: source-only GitHub installation, no lockfile, and Bun test/typecheck/format workflows.

Each test file must contain exactly one test. Each test must produce exactly one visual SVG snapshot. Keep numerical and error assertions in the same test as the corresponding visual example.

Circuit JSON uses CAD world coordinates: mm, +Z up. PoppyGL uses glTF coordinates: mm, +Y up. Convert at the boundary as (x, y, z) -> (x, z, -y), including section plane signs and retained sides. Use explicit axis names. Do not use front/back direction names.

Use snake_case enum values. Do not introduce a style enum: drawing views always use PoppyGL outline rendering.

No native or Node-specific imports in the public entry point. Test-only visual rasterization dependencies may be native.
