#!/bin/sh
# Rebuilds trace-viewer.html from the files in src/
cd "$(dirname "$0")"
{ cat src/head.html; echo '<script>'; cat src/sample.js; cat src/app.js; echo '</script>'; echo '</body></html>'; } > trace-viewer.html
echo "Built trace-viewer.html"
