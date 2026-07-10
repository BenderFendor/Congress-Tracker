export function filingIntervalState(transactionDate, disclosureDate, lagDays) {
  if (lagDays !== null && lagDays !== undefined) {
    return {
      kind: "measured",
      label: `${lagDays} day filing interval`,
    }
  }

  if (transactionDate && disclosureDate && transactionDate > disclosureDate) {
    return {
      kind: "anomaly",
      label: "Source dates are out of order; filing interval unavailable",
    }
  }

  return {
    kind: "unavailable",
    label: "Filing interval unavailable",
  }
}
