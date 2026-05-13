import { Helmet } from 'react-helmet-async'

type Props = {
  /** Any valid JSON-LD object. Schema.org @context + @type live here. */
  data: Record<string, unknown> | Record<string, unknown>[]
}

/**
 * Emit a `<script type="application/ld+json">` block via react-helmet-async.
 *
 * Wraps an object (or array of objects) in a script tag so Google's
 * structured-data parser finds it. The serializer strips dangerous chars
 * (`<` / `>` inside strings) so the script is safe even if the source
 * data ever contains user-provided HTML.
 */
export function JsonLd({ data }: Props) {
  const serialized = JSON.stringify(data).replace(/</g, '\\u003c')
  return (
    <Helmet>
      <script type="application/ld+json">{serialized}</script>
    </Helmet>
  )
}
