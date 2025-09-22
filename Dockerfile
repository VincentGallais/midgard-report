FROM public.ecr.aws/docker/library/node:21-alpine

# Install the required tools and libraries
RUN apk add --no-cache \
    curl \
    git

# Project
WORKDIR /midgard

# Get the git info
COPY ./.git /.git
RUN touch git-info.txt \
    && git log -1 --pretty=format:"%h" >> git-info.txt \
    && echo "\n" >> git-info.txt \
    && git tag --sort=-creatordate --merged | head -n 1 >> git-info.txt

# Build the server
COPY . /midgard

# Run the Midgard server with NODE_PATH set to include node_modules directory
EXPOSE 8080
CMD [ "npm", "run", "start" ]