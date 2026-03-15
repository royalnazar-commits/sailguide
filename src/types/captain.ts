/**
 * Captain monetization types.
 *
 * CaptainSettings  — stored per user in captainStore when role === 'CAPTAIN'
 * PurchasedItem    — tracks individual item buys and captain subscriptions
 */

export interface CaptainSettings {
  /** Whether this captain has enabled the subscription tier */
  subscriptionEnabled: boolean
  /** Monthly price (USD) for subscribers */
  subscriptionPriceUsd: number
}

export type PurchaseItemType = 'ROUTE' | 'PLACE' | 'SUBSCRIPTION'

export interface PurchasedItem {
  id: string
  type: PurchaseItemType
  /**
   * routeId / placeId for item purchases
   * captainId for subscription purchases
   */
  itemId: string
  /** The captain whose content was purchased / subscribed to */
  captainId: string
  priceUsd: number
  purchasedAt: string
}
