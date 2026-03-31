import { useState, useEffect } from 'react'
import { fetchNews } from '../api'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

function NewsCard({ article }) {
  const ago = timeAgo(article.published_at)

  return (
    <a
      href={article.link || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 bg-panel border border-border rounded-xl p-4 hover:border-accent/40 transition-colors group"
    >
      {article.thumbnail && (
        <img
          src={article.thumbnail}
          alt=""
          className="w-20 h-16 object-cover rounded-lg shrink-0 bg-border"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
      <div className="flex-1 min-w-0">
        <h3 className="text-primary text-sm font-semibold leading-snug group-hover:text-accent transition-colors line-clamp-2">
          {article.title || 'Untitled'}
        </h3>
        {article.summary && (
          <p className="text-secondary text-xs mt-1 leading-relaxed line-clamp-2">
            {article.summary}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 text-xs text-secondary">
          {article.publisher && (
            <span className="font-medium text-accent/80">{article.publisher}</span>
          )}
          {article.publisher && ago && <span>·</span>}
          {ago && <span>{ago}</span>}
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" className="ml-auto shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" strokeLinecap="round"/>
            <polyline points="15 3 21 3 21 9" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="10" y1="14" x2="21" y2="3" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    </a>
  )
}

export default function News({ symbol }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!symbol) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setArticles([])
    fetchNews(symbol)
      .then(d => {
        if (!controller.signal.aborted) {
          setArticles(Array.isArray(d) ? d : [])
          setLoading(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('Failed to load news')
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [symbol])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-center text-secondary text-sm">{error}</div>
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-secondary uppercase tracking-wider">
          {symbol} — Latest News
        </h2>
        {articles.length > 0 && (
          <span className="text-xs text-secondary">{articles.length} articles</span>
        )}
      </div>

      {articles.length === 0 ? (
        <div className="bg-panel border border-border rounded-xl p-8 text-center text-secondary text-sm">
          No recent news available for {symbol}.
        </div>
      ) : (
        <div className="space-y-2">
          {articles.map((article, i) => (
            <NewsCard key={article.link || i} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
