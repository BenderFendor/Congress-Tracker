export function filterInfluenceNetworks(networks, query, category = "all") {
  const needle = query.trim().toLowerCase()
  return networks.filter((network) => {
    if (category !== "all" && network.category !== category) return false
    if (!needle) return true
    const searchText = [
      network.display_name,
      network.description,
      network.network_slug,
      ...(network.aliases ?? []),
    ].join(" ").toLowerCase()
    return searchText.includes(needle)
  })
}

export function influenceDossierPath(network) {
  return `/influence/${encodeURIComponent(network.network_slug)}`
}
