import { geoMercator, geoPath } from "d3"

/**
 * Fit a projection directly to the selected jurisdiction's county geometry.
 * Mercator is intentional here: geoAlbersUsa only projects the 50 states and
 * DC, returning null paths for American Samoa, Guam, the Northern Mariana
 * Islands, Puerto Rico, and the U.S. Virgin Islands.
 */
export function createCountyPath(features, width, height) {
  const projection = geoMercator()
  if (features.length > 0) {
    projection.fitExtent(
      [[28, 64], [width - 28, height - 60]],
      { type: "FeatureCollection", features },
    )
  }
  return geoPath(projection)
}
