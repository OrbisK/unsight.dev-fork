import type { IssueMetadata } from '~~/server/utils/embeddings'
import { defineCachedCorsEventHandler } from '~~/server/utils/cached-cors'
import { findDuplicates } from '~~/server/utils/cluster'
import { getStoredEmbeddingsForRepo } from '~~/server/utils/embeddings'

export default defineCachedCorsEventHandler(async (event) => {
  const { owner, repo } = getRouterParams(event)
  if (!owner || !repo) {
    throw createError({
      status: 400,
      message: 'Invalid repository',
    })
  }

  const [issues, embeddings] = await getStoredEmbeddingsForRepo(owner, repo)
    .then((r) => {
      const issues: IssueMetadata[] = []
      const embeddings: number[][] = []

      for (const res of r) {
        if (res.metadata.state !== 'closed') {
          issues.push(res.metadata)
          embeddings.push(res.embeddings)
        }
      }
      return [issues, embeddings] as const
    })

  const duplicates = findDuplicates(issues, embeddings)

  return duplicates.map(issues => issues.map(i => ({
    owner: i.owner,
    score: Math.round(i.score * 100) / 100,
    repository: i.repository,
    number: i.number,
    title: i.title,
    url: i.url,
    state: i.state,
    updated_at: i.updated_at,
    labels: i.labels,
  })))
}, {
  swr: true,
  getKey(event) {
    const { owner, repo } = getRouterParams(event)
    return `v${2 + currentIndexVersion}:duplicates:${owner}:${repo}`.toLowerCase()
  },
})
