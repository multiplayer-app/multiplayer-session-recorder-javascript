import express, {
  type Request,
  type Response,
  type NextFunction
} from 'express'

const { Router } = express
const router = Router()

const health = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.status(200).json({})
  } catch (err) {
    return next(err)
  }
}

router.route('/').get(health)

export default router
