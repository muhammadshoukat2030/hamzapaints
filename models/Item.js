import mongoose from "mongoose";

const agentItemSchema = new mongoose.Schema({
  agent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Agent",
    required: true
  },

  // Total products sold in this sale for this agent
  totalProductSold: {
    type: Number,
    required: true
  },

  // Total amount of these sold products
  totalProductAmount: {
    type: Number,
    required: true
  },

  // Agent percentage entered by shopkeeper (e.g. 5, 10, 15)
  percentage: {
    type: Number,
    required: true
  },

  // Amount given to agent (auto calculate: totalProductAmount * percentage / 100)
  percentageAmount: {
    type: Number,
    required: true
  },

  // Paid OR Unpaid status
  paidStatus: {
    type: String,
    enum: ["Paid", "Unpaid", "Partial"],
    default: "Unpaid"
  },

  // For later partial or full payment
  paidAmount: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

export default mongoose.model("AgentItem", agentItemSchema);
