# DarkOps demonstration — 3 minutes 30 seconds

Recorded from the working local prototype. Synthetic operations data and sample photos; live Gemini calls; simulated actions and follow-up. Narration uses a computer-generated voice.

## DARKOPS  /  From signal to investigation

Meet Dark Ops, by Sherlops: an operations intelligence prototype for quick commerce stores. This is the working application, running locally with synthetic Bengaluru data. The dashboard brings together identified loss, open investigations, waste rate, and stock approaching expiry, so a store lead can decide where to investigate first.

## 01  /  Focus on the store that needs attention

Let's focus on Indiranagar. Changing the store filter updates the operational snapshot and narrows the investigation queue. Returning to all stores restores the network view. The main metrics are calculated by the backend from the demo records. Some surrounding comparison labels remain illustrative prototype values.

## 02  /  Search the investigation queue

Next, we open Investigations and search for tomatoes. The queue narrows immediately. Opening the matching case reveals the affected product, store, estimated loss, and complaint photo. The case keeps the operational signal and its supporting context together, ready for review.

## 03  /  Inspect the evidence behind the signal

Scrolling through the case reveals why it was flagged and the supporting measurements. The tomato waste spike is compared with its baseline, while other evidence helps distinguish a supplier problem from a change in demand. Ranked hypotheses make the reasoning visible. These rankings are prototype signals, not calibrated probabilities.

## 04  /  Request a live Gemini investigation

Now we request a live Gemini investigation. Dark Ops sends the case's synthetic evidence to the configured model. The returned report explains a likely cause, proposes next steps, and identifies evidence gaps. The operator can compare that explanation with the measurements. Gemini interprets the supplied facts; it does not calculate the dashboard totals.

## 05  /  Record a simulated operational action

We record the suggested action for the store manager. The application confirms the action and attaches it to this case. This is a simulated workflow record: it does not send a supplier claim or change a retailer's inventory. Recording the action unlocks the follow-up check.

## 06  /  Run the simulated seven-day follow-up

Clicking Simulate plus seven days completes the follow-up and displays the before-and-after values. The case now has a recorded action and a verification result. These outcomes are synthetic, demonstrating how the workflow closes the loop without claiming a real-world improvement.

## 07  /  Analyze a complaint photo with Gemini

The Photo Forensics Lab adds another evidence path. We analyze an AI-generated tomato complaint photo using live Gemini on Vertex AI. The result shows visible damage, an assessment, confidence, and a recommended response. Package details can be reported when legible. The engine label identifies the analysis used, and a human can review the recommendation before acting.

## 08  /  Flag a reused refund photo for review

Now we select the seeded duplicate-photo complaint. The application compares a perceptual hash with its local image index and flags a match for review. Although the interface uses the word vector, this prototype uses perceptual hashing. A matching photo is a review signal, not proof that a customer committed fraud.

## DARKOPS  /  Find the signal. Build the case.

Finally, we export the investigation report. Dark Ops connects signals, evidence, analysis, action, and follow-up in one working prototype. Find the signal. Build the case.