import { TaskDeliveryProps } from "../../../types/tasks";

/**
 * PR urls the task's Delivery row already shows, lowercased (the server
 * stores them that way; GitHub's `html_url` on an auto-link keeps the
 * owner's casing). TaskMainBlock hides the matching auto-linked entries
 * from the Links list so the same PR isn't listed twice: a delivery row
 * is the stateful version of that link.
 */
export const deliveryPrUrls = (deliveries: TaskDeliveryProps[]): Set<string> =>
    new Set(deliveries.flatMap((d) => (d.pr_url ? [d.pr_url.toLowerCase()] : [])));
