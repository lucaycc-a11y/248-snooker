'use client'

export default function LineChart() {
  return (
    <div className="sg-line-chart" aria-label="Balance trend mock chart">
      <svg viewBox="0 0 320 90" preserveAspectRatio="none" role="img" aria-label="Balance trend">
        <defs>
          <linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--green)" stopOpacity=".24" />
            <stop offset="1" stopColor="var(--green)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 56 C28 53 34 76 64 66 S108 77 132 70 S164 66 190 54 S224 30 242 42 S276 30 320 35 L320 90 L0 90Z"
          fill="url(#lineFill)"
        />
        <path
          d="M0 56 C28 53 34 76 64 66 S108 77 132 70 S164 66 190 54 S224 30 242 42 S276 30 320 35"
          fill="none"
          stroke="var(--green-bright)"
          strokeWidth="2"
        />
        <circle
          cx="242"
          cy="42"
          r="4"
          fill="var(--bg-elevated)"
          stroke="var(--green-bright)"
          strokeWidth="2"
        />
      </svg>
      <span className="sg-chart-callout">+$320</span>
      <div className="sg-axis sg-mono">
        <span>16</span>
        <span>17</span>
        <span>18</span>
        <span>19</span>
        <span>20</span>
        <span>21</span>
        <span>22</span>
        <span>23</span>
      </div>
    </div>
  )
}
