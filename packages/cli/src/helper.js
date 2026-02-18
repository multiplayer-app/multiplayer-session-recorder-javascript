import jwt from 'jsonwebtoken'

export const decodeJwtToken = (jwtToken) => {
  return jwt.decode(jwtToken)
}
