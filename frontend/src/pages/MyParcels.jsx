import { useEffect, useState } from 'react';
import { landService } from '../services/landService';
import LandCard from '../components/common/LandCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { Link } from 'react-router-dom';
import { FiMap } from 'react-icons/fi';

export default function MyParcels() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    landService.getMyParcels()
      .then(r => setParcels(r.data.parcels))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-wrapper page-enter space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title">My Parcels</h1>
          <p className="section-sub">{parcels.length} land parcel{parcels.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Link to="/register-land" className="btn-primary text-sm">+ Register New</Link>
      </div>

      {loading ? <LoadingSpinner text="Loading your parcels..." /> : (
        parcels.length === 0 ? (
          <div className="card p-16 text-center">
            <FiMap className="mx-auto text-5xl text-slate-700 mb-4" />
            <p className="text-slate-400 mb-4">You have no registered parcels yet</p>
            <Link to="/register-land" className="btn-primary inline-flex">Register Land</Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {parcels.map((p, i) => <LandCard key={p._id} parcel={p} index={i} />)}
          </div>
        )
      )}
    </div>
  );
}