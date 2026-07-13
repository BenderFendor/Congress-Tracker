"use client"

import { useParams } from "next/navigation"
import { LobbyingEntityDetailPage } from "@/components/lobbying-entity-pages"

export default function Page() {
  const { id } = useParams<{ id: string }>()
  return <LobbyingEntityDetailPage kind="clients" id={id} />
}
