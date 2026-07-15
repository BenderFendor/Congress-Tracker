import { CandidateDossier } from "@/components/dossiers/candidate/candidate-dossier"

export default function CandidateDossierPage({ params }: { params: { id: string } }) {
  return <CandidateDossier candidateId={params.id} />
}
