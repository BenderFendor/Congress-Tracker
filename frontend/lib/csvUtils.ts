export interface TopSpender {
  client: string
  totalSpent: number
}

export interface TopLobbyingFirm {
  firm: string
  totalIncome: number
}

export interface Industry {
  name: string
  total: number
}

export interface LobbyistRecipient {
  recipient: string
  fromLobbyists: number
  fromLobbyistsFamily: number
  cycle: string
}

// Parse CSV text to array of objects
export function parseCSV(csvText: string): string[][] {
  const lines = csvText.trim().split('\n')
  return lines.map(line => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  })
}

// Parse monetary string like "$1998920680" to number
export function parseMoneyString(moneyStr: string): number {
  return parseInt(moneyStr.replace(/[$,]/g, ''), 10) || 0
}

export { formatCompactCurrency as formatCurrency } from "./format";

// Parse Top Spenders CSV
export function parseTopSpenders(csvText: string): TopSpender[] {
  const rows = parseCSV(csvText)
  return rows.slice(1).map(row => ({
    client: row[0]?.replace(/"/g, '') || '',
    totalSpent: parseMoneyString(row[1] || '0')
  })).filter(item => item.client && item.totalSpent > 0)
}

// Parse Top Lobbying Firms CSV
export function parseTopLobbyingFirms(csvText: string): TopLobbyingFirm[] {
  const rows = parseCSV(csvText)
  return rows.slice(1).map(row => ({
    firm: row[0]?.replace(/"/g, '') || '',
    totalIncome: parseMoneyString(row[1] || '0')
  })).filter(item => item.firm && item.totalIncome > 0)
}

// Parse Industries CSV
export function parseIndustries(csvText: string): Industry[] {
  const rows = parseCSV(csvText)
  return rows.slice(1).map(row => ({
    name: row[0]?.replace(/"/g, '') || '',
    total: parseMoneyString(row[1] || '0')
  })).filter(item => item.name && item.total > 0)
}

// Parse Lobbyist Recipients CSV
export function parseLobbyistRecipients(csvText: string, cycle: string): LobbyistRecipient[] {
  const rows = parseCSV(csvText)
  return rows.slice(1).map(row => ({
    recipient: row[0]?.replace(/"/g, '') || '',
    fromLobbyists: parseMoneyString(row[1] || '0'),
    fromLobbyistsFamily: parseMoneyString(row[2] || '0'),
    cycle
  })).filter(item => item.recipient && item.fromLobbyists > 0)
}
