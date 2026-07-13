import type { GeoPath, GeoPermissibleObjects } from "d3"
import type { Feature, Geometry } from "geojson"

export function createCountyPath(
  features: Array<Feature<Geometry, { name?: string }>>,
  width: number,
  height: number,
): GeoPath<unknown, GeoPermissibleObjects>
