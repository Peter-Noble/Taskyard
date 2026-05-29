import { threadStatusBadge } from '@/lib/format-ui';

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { variant, label } = threadStatusBadge(status as Parameters<typeof threadStatusBadge>[0]);
  return (
    <span className={`badge badge-${variant}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}
