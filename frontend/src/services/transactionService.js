import api from "./api";

export const transactionService = {
  initiate: (data) => api.post("/transactions/initiate", data),
  sellerApprove: (id, body = {}) =>
    api.put(`/transactions/${id}/seller-approve`, body),
  govApprove: (id, body = {}) =>
    api.put(`/transactions/${id}/gov-approve`, body),
  cancel: (id) => api.put(`/transactions/${id}/cancel`),
  getMy: () => api.get("/transactions/my"),
  getPending: () => api.get("/transactions/pending"),
  updateBlockchain: (id, data) =>
    api.put(`/transactions/${id}/blockchain-update`, data),
};
