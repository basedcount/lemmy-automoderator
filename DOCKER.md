Personal notes for publishing new versions of the bot with Docker:

# Build new container
`docker build -t ornatot/lemmy-automoderator .`

# Publish image
`docker login`

`docker push ornatot/lemmy-automoderator`