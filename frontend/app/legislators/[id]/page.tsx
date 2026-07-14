import { MemberDossier } from "@/components/dossiers/member/member-dossier"

export default function LegislatorProfilePage({ params }: { params: { id: string } }) {
  return <MemberDossier memberId={params.id} />
}
