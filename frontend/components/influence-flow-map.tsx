"use client"

/* Design thesis: Evidence River turns dense campaign-finance records into a left-to-right audit trail without implying unsupported edges. */

import Link from "next/link"
import { ArrowRight, CheckCircle2, ExternalLink, FileQuestion, Landmark, Scale, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { InfluenceNetwork, InfluenceNetworkFinancials } from "@/lib/services/influence"
import { buildInfluenceFlow } from "@/lib/influence-financials.mjs"

type InfluenceFlowMapProps = {
  network: Pick<InfluenceNetwork, "network_slug" | "display_name" | "confidence" | "source_citation" | "committees">
  financials: InfluenceNetworkFinancials | null | undefined
  cycle: number
  financialError?: string
  compact?: boolean
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })

const channelCopy = {
  direct: "Contributions reported through candidate and committee records.",
  support: "Independent expenditures that support a named candidate.",
  oppose: "Independent expenditures that oppose a named candidate.",
} as const

type FlowRecipient = InfluenceNetworkFinancials["top_recipients"][number] & {
  amount: number
  direct: number
  support: number
  oppose: number
}
type FlowModel = {
  channels: Array<{ key: keyof typeof channelCopy; label: string; amount: number; tone: keyof typeof channelCopy }>
  calculatedTotal: number
  reconciled: boolean
  recipients: FlowRecipient[]
  recipientCoverage: number
}

export function InfluenceFlowMap({ network, financials, cycle, financialError, compact = false }: InfluenceFlowMapProps) {
  const flow = buildInfluenceFlow(financials) as FlowModel | null
  const maxChannel = Math.max(...(flow?.channels.map((channel) => channel.amount) ?? [0]), 1)
  const maxRecipient = Math.max(...(flow?.recipients.map((recipient) => recipient.amount) ?? [0]), 1)

  return (
    <section className="influence-flow" aria-labelledby={`flow-${network.network_slug}`}>
      <header className="influence-flow__header">
        <div>
          <p className="influence-flow__eyebrow">Verified evidence path · {cycle} cycle</p>
          <h3 id={`flow-${network.network_slug}`}>How the network reaches federal races</h3>
          <p>Read left to right. Committee identities establish the network boundary. FEC records then separate direct giving from independent support and opposition.</p>
        </div>
        <div className="influence-flow__status">
          <CheckCircle2 size={15} aria-hidden="true" />
          <span>{network.confidence} identity match</span>
        </div>
      </header>

      <div className="influence-flow__legend" aria-label="Graph legend">
        <span><i className="is-identity" /> Verified committee identity</span>
        <span><i className="is-direct" /> Direct contribution</span>
        <span><i className="is-support" /> Independent support</span>
        <span><i className="is-oppose" /> Independent opposition</span>
      </div>

      <div className="influence-flow__map">
        <div className="influence-flow__column">
          <div className="influence-flow__column-title"><Landmark size={16} /> Network boundary</div>
          {network.committees.length > 0 ? network.committees.map((committee) => (
            <a
              className="influence-flow__committee"
              href={`https://www.fec.gov/data/committee/${encodeURIComponent(committee.committee_id)}/?cycle=${cycle}`}
              key={committee.committee_id}
              rel="noreferrer"
              target="_blank"
            >
              <strong>{committee.committee_name}</strong>
              <span>{committee.committee_id} · {committee.role.replaceAll("_", " ")}</span>
              <small>{committee.confidence} · {committee.source_citation} <ExternalLink size={11} /></small>
            </a>
          )) : (
            <div className="influence-flow__empty"><FileQuestion size={18} /><span>No committee identity is linked in the current source run.</span></div>
          )}
          <p className="influence-flow__boundary-note">Identity links do not allocate the network total to an individual committee.</p>
        </div>

        <ArrowRight className="influence-flow__arrow" aria-hidden="true" />

        <div className="influence-flow__column">
          <div className="influence-flow__column-title"><Scale size={16} /> FEC activity channels</div>
          {financialError ? (
            <div className="influence-flow__empty is-error"><FileQuestion size={18} /><span>{financialError}</span></div>
          ) : flow ? flow.channels.map((channel) => (
            <div className={`influence-flow__channel is-${channel.tone}`} key={channel.key}>
              <div><strong>{channel.label}</strong><b>{money.format(channel.amount)}</b></div>
              <div className="influence-flow__track" aria-hidden="true"><span style={{ width: `${channel.amount === 0 ? 0 : Math.max((channel.amount / maxChannel) * 100, 2)}%` }} /></div>
              <p>{channelCopy[channel.key as keyof typeof channelCopy]}</p>
            </div>
          )) : (
            <div className="influence-flow__empty"><FileQuestion size={18} /><span>No canonical financial aggregate is available for this network and cycle.</span></div>
          )}
          {flow ? (
            <div className={`influence-flow__reconcile ${flow.reconciled ? "is-ok" : "is-warning"}`}>
              <span>Channel total</span>
              <strong>{money.format(flow.calculatedTotal)}</strong>
              <small>{flow.reconciled ? "Reconciles with the API total" : "Does not reconcile with the reported API total; treat as partial"}</small>
            </div>
          ) : null}
        </div>

        <ArrowRight className="influence-flow__arrow" aria-hidden="true" />

        <div className="influence-flow__column">
          <div className="influence-flow__column-title"><Users size={16} /> Loaded member records</div>
          {flow && flow.recipients.length > 0 ? (
            <ol className="influence-flow__recipients">
              {flow.recipients.slice(0, compact ? 5 : 12).map((recipient, index) => (
                <li key={recipient.bioguide_id}>
                  <Link href={`/legislators/${recipient.bioguide_id}`}>
                    <span className="influence-flow__rank">{String(index + 1).padStart(2, "0")}</span>
                    <span className="influence-flow__person"><strong>{recipient.first_name} {recipient.last_name}</strong><small>{recipient.party} · {recipient.chamber} · {recipient.state}</small></span>
                    <b title={`Direct ${money.format(recipient.direct)}; support ${money.format(recipient.support)}; opposition ${money.format(recipient.oppose)}`}>
                      {money.format(recipient.amount)} activity
                    </b>
                  </Link>
                  <div className="influence-flow__recipient-track" aria-hidden="true"><span style={{ width: `${Math.max((recipient.amount / maxRecipient) * 100, 2)}%` }} /></div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="influence-flow__empty"><FileQuestion size={18} /><span>No source-linked member records are loaded for this network and cycle.</span></div>
          )}
          {flow && flow.recipients.length > 0 ? (
            <p className="influence-flow__coverage">Showing {Math.round(flow.recipientCoverage * 100)}% of reported network activity represented by the loaded recipient list. Each amount combines separately reported direct contributions, independent support, and independent opposition; opposition is not money received.</p>
          ) : null}
        </div>
      </div>

      <footer className="influence-flow__footer">
        <span>Source: {network.source_citation || "OpenFEC committee and transaction records"}</span>
        <span>Coverage: {network.committees.length} verified committee {network.committees.length === 1 ? "identity" : "identities"}; financial cycle {cycle}</span>
        <Badge variant="outline">FEC only · LDA excluded</Badge>
      </footer>
    </section>
  )
}
