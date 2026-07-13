"use client"

import Image from "next/image"
import { useState } from "react"
import { memberInitials, memberPortraitCandidates } from "@/lib/member-identity.mjs"

type MemberPortraitProps = {
  bioguideId?: string | null
  name: string
  suppliedUrls?: Array<string | null | undefined>
  className?: string
  imageClassName?: string
  fallbackClassName?: string
  width?: number
  height?: number
  priority?: boolean
  ariaHidden?: boolean
}

function PortraitResolver({
  candidates,
  name,
  imageClassName,
  fallbackClassName,
  width,
  height,
  priority,
  ariaHidden,
}: Omit<MemberPortraitProps, "bioguideId" | "suppliedUrls" | "className"> & { candidates: string[] }) {
  const [candidateIndex, setCandidateIndex] = useState(0)
  const candidate = candidates[candidateIndex]

  if (!candidate) {
    return <span className={fallbackClassName}>{memberInitials(name)}</span>
  }

  return (
    <Image
      src={candidate}
      alt={ariaHidden ? "" : `Official portrait of ${name}`}
      aria-hidden={ariaHidden || undefined}
      width={width}
      height={height}
      priority={priority}
      unoptimized
      className={imageClassName}
      onError={() => setCandidateIndex((current) => current + 1)}
    />
  )
}

export function MemberPortrait({
  bioguideId,
  name,
  suppliedUrls = [],
  className = "member-identity-portrait",
  imageClassName = "member-identity-image",
  fallbackClassName = "member-identity-fallback",
  width = 320,
  height = 400,
  priority = false,
  ariaHidden = false,
}: MemberPortraitProps) {
  const candidates = memberPortraitCandidates({ bioguideId, suppliedUrls })
  const identityKey = `${bioguideId || "unknown"}|${candidates.join("|")}`

  return (
    <span className={className} aria-label={ariaHidden ? undefined : `${name} portrait`}>
      <PortraitResolver
        key={identityKey}
        candidates={candidates}
        name={name}
        imageClassName={imageClassName}
        fallbackClassName={fallbackClassName}
        width={width}
        height={height}
        priority={priority}
        ariaHidden={ariaHidden}
      />
    </span>
  )
}
