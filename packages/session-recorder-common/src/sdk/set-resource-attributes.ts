let resourceAttributes: Record<string, any> = {}

export const setResourceAttributes = (attributes: Record<string, any>) => {
  resourceAttributes = attributes
}

export const getResourceAttributes = () => {
  return resourceAttributes
}
