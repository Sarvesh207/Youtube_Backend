const asyncHandler = (requestHandler) => {
  return (req, res, next) => {
        Premise.resolve(requestHandler(req, res, next)).catch((err) => next(err))
    }
}

export {asyncHandler}

// const asyncHandler = () => {}
// const asyncHandler = (func) => {() => {}}
// const asyncHandler = (func) => async () => {}

// const asyncHandler = (fn) => async(req, res, next) =>{
//     try {
//         await fu(req, res, next)
//     } catch (error) {
//         res.status(err.code || 500).json({
//             success:false,
//             message:err.message
//         })
//     }
// }