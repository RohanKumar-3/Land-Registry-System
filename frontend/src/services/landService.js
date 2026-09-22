import api from './api';

export const landService = {
  getAll:        (params) => api.get('/lands', { params }),
  getById:       (id)     => api.get(`/lands/${id}`),
  getMyParcels:  ()       => api.get('/lands/my-parcels'),
  register:      (data)   => api.post('/lands/register', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update:        (id, data) => api.put(`/lands/${id}`, data),
  // listForSale:   (id, price) => api.put(`/lands/${id}/list`, { price }),
  govApprove:    (id)     => api.put(`/lands/${id}/government-approve`),
  delete:        (id)     => api.delete(`/lands/${id}`),
  triggerVerify: (id)     => api.post(`/verify/${id}`),
  getLogs:       (id)     => api.get(`/verify/${id}/logs`),
  listForSale: (id, data) => api.put(`/lands/${id}/list`, data),
};