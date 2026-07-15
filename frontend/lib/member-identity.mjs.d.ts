export function canonicalBioguideId(value: unknown): string
export function isUsablePortraitUrl(value: unknown): value is string
export function officialBioguidePortrait(value: unknown): string
export function memberPortraitCandidates(input: { bioguideId?: unknown; suppliedUrls?: Array<string | null | undefined> }): string[]
export function memberInitials(name: unknown): string
