## Todo
- Add scheduling to practice mode
- Fix wordlist layout (research grid more prob)
- Add shadcn table on home page collections list
- Fix bug with local wordlist not updating on add/delete
    - happened after adding collections i think
- Add translations
    - figure out types
    - add glosbe scraping
- Switch to fetching wordlist on load and worddata on click, probably

## Etc
- Now loading entire db on page load, might want to check later for size/speed issues

- Handling errors with suspense boundaries and useSuspenseQuery is very annoying, could not figure it out so just returning the error from fetch func instead of throwing it for now. Only reason for doing this is that I wanted to use useDeferredValue to prevent flickering

- Use an orm next time doing database stuff!