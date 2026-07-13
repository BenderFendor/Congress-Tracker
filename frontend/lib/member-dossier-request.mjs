export function createMemberDossierRequest(memberId) {
  const controller = new AbortController()
  let active = true

  return {
    memberId,
    signal: controller.signal,
    commit(responseMemberId, update) {
      if (!active || controller.signal.aborted || responseMemberId !== memberId) return false
      update()
      return true
    },
    cancel() {
      active = false
      controller.abort()
    },
  }
}

export function isAbortError(error) {
  return error instanceof Error && error.name === "AbortError"
}
