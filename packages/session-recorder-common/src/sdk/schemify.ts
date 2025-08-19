import * as _toJsonSchema from 'to-json-schema'

// @ts-ignore
const toJsonSchema = _toJsonSchema?.default || _toJsonSchema

const defaultSchemifyOptions: _toJsonSchema.Options = {
  strings: {
    preProcessFnc: (value: string, defaultFnc: any) => {
      if (value?.length >= 30) {
        return defaultFnc('some_string')
      }


      return defaultFnc(value)
    },
  },
  arrays: {
    mode: 'first',
  },
}

export default (
  payload: string | object | undefined,
  stringify = true,
  options: _toJsonSchema.Options = defaultSchemifyOptions,
): any => {
  if (!payload) {
    return ''
  }

  let payloadJson: any

  if (typeof payload === 'string') {
    try {
      payloadJson = JSON.parse(payload)
    } catch {
      return payload
    }
  } else if (typeof payload === 'object') {
    payloadJson = payload
  } else {
    return payload
  }

  try {
    const schema = toJsonSchema(payloadJson, options)

    if (stringify) {
      return JSON.stringify(schema)
    }

    return schema
  } catch (err) {
    // error can happen when array has items like ['test', 'asd', '1'], type for '1' is null
    return ''
  }
}
