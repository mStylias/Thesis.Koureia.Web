import { asHealthReport } from './health';
import { parseHttpError } from './http-error';

// The shape MapSynaxHealthChecks writes: enums and TimeSpans as .NET strings.
const report = {
  overallStatus: 'Unhealthy',
  checks: [
    {
      name: 'database',
      status: 'Unhealthy',
      description: 'Connection refused.',
      duration: '00:00:00.0120000',
    },
    // The server sends description as null and does not omit it.
    { name: 'outbox', status: 'Healthy', description: null, duration: '00:00:00.0030000' },
  ],
  totalDuration: '00:00:00.0150000',
};

describe('asHealthReport', () => {
  it('reads a report from a success body', () => {
    expect(asHealthReport(report)?.checks[1].name).toBe('outbox');
  });

  it('recovers the report from the raw body of the 503 an unhealthy check produces', () => {
    const error = parseHttpError(503, report);

    expect(error.errorCode).toBe('HTTP_503'); // not a problem document
    expect(asHealthReport(error.raw)?.overallStatus).toBe('Unhealthy');
  });

  it('parses a JSON string body', () => {
    expect(asHealthReport(JSON.stringify(report))?.overallStatus).toBe('Unhealthy');
  });

  it('returns null for anything that is not a report', () => {
    expect(asHealthReport(null)).toBeNull();
    expect(asHealthReport('<html>502</html>')).toBeNull();
    expect(asHealthReport({ overallStatus: 'Nonsense', checks: [] })).toBeNull();
    expect(asHealthReport({ overallStatus: 'Healthy' })).toBeNull();
  });
});
