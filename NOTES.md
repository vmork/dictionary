## Todo
- Add srs mode
    - enter/exit button placement
    - scheduling

## Etc
- Now loading entire db on page load, might want to check later for size/speed issues
- Handling errors with suspense boundaries and useSuspenseQuery is very annoying, could not figure it out so just returning the error from fetch func instead of throwing it for now. Only reason for doing this is that I wanted to use useDeferredValue to prevent flickering