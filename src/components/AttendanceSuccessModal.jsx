import { CheckCircle2 } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { formatTime } from '../utils/format'

export default function AttendanceSuccessModal({ success, timezone, onClose }) {
  const isCheckIn = success.type === 'in'
  const title = isCheckIn ? 'Check-in successful!' : 'Check-out successful!'

  return (
    <Modal open onClose={onClose} title={title} hideHeader size="sm">
      <div className="py-2 text-center">
        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100/60 text-emerald-600">
          <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 animate-scale-in">
            <CheckCircle2 size={48} strokeWidth={2.5} className="draw-check-icon" aria-hidden="true" />
          </div>
        </div>
        <h2 className="mb-2 text-2xl font-bold text-slate-900">{title}</h2>
        <p className="mb-5 text-sm leading-relaxed text-slate-600">
          Your {isCheckIn ? 'arrival' : 'departure'} was recorded successfully.
        </p>
        <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          <p>{isCheckIn ? 'Check-in' : 'Check-out'} time: <strong className="text-slate-900">
            {formatTime(isCheckIn ? success.row.check_in : success.row.check_out, timezone)}
          </strong></p>
          {isCheckIn ? <p className="mt-1">Attendance: <strong className={success.row.status === 'late' ? 'text-amber-700' : 'text-emerald-700'}>
            {success.row.status === 'late' ? 'Late' : 'Present'}
          </strong></p> : null}
        </div>
        <Button onClick={onClose} fullWidth className="min-h-12 rounded-full bg-slate-900 font-bold hover:bg-slate-800">
          Continue
        </Button>
      </div>
    </Modal>
  )
}
