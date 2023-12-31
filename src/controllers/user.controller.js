import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
     const user =  await User.findById(userId)
     const accessToken = user.generateAccessToken();
     const refreshToken = user.generateRefreshToken();


     user.refreshToken = refreshToken;

    await user.save({validateBeforeSave: false});
    return {accessToken, refreshToken}

  } catch (error) {
    throw new ApiError(500, "Something went wrong while genreating refresh and access token");
  }
}

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  // validation - not empty or wromg input
  // check if user already exist : username or email
  // check for images , check for avatr
  // upload them to cloudniary
  // create user object - create entry in db
  // remove password and refresh token field from response
  //  check user creation
  //  return res

  const { fullName, email, username, password } = req.body;
  

  if (
    [fullName, email,username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "Please fill all the fields");
  }

  // check is user already user existes
  const existedUser = await  User.findOne({
    $or:[{ email }, { username }]
  })

  if(existedUser){
    throw new ApiError(409, "User already exists");
  }

  // console.log(req.files)

  const avatarLocalPath = req.files?.avatar[0]?.path;

  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if(!avatarLocalPath){
    throw new ApiError(400, "Please upload avatar");
  }

  //  Upload Imges fiels to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if(!avatar){
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar : avatar.url,
    coverImage : coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(), 
  });

  const createdUser = User.findById(user._id).select(
    "-password -refreshToken"
  )

  if(!createdUser){
    throw new ApiError(500, "Spmething went wrong while registering the user ");
  }
  const cleanUser = {
    _id: createdUser._id,
    fullName: createdUser.fullName,
    email: createdUser.email,
    

    
  };
  
  return res.status(201).json(new ApiResponse(200,cleanUser, "User registered successfully" ))

});

const loginUser = asyncHandler(async(req,res) => {
  // req.body => data
  // username or email
  // find the user
  // check for password
  // access and refresh token generate 
  //  return into cookies (secuire)

  const {username, email, password}  = req.body;
  if(!username && !email){
    throw new ApiError(400, "username or email is required");
  }

  const user = await User.findOne({$or:[{username},{email}]})


  // Here is an alternative of above code 
  // if(!(username || email)){
  //   throw new ApiError(400, "username or email is required");
  // }
  if(!user){
    throw new ApiError(404, "User does not exits");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if(!isPasswordValid){
    throw new ApiError(401, "Invalid user credentials");
  }

  const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id);
  console.log("refreshToekn :",refreshToken);

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  const options = {
    httpOnly: true,
    secure:true
  }

  return res.status(200)
  .cookie("accessToken", accessToken,options)
  .cookie("refreshToken", refreshToken,options)
  .json( new ApiResponse(
    200,
    {
      user: loggedInUser,accessToken, refreshToken
    },
    "User Logged In Successfully"
  ))
})

const logoutUser = asyncHandler(async(req,res) => {

  console.log(req.user) 
  const user = await User.findByIdAndUpdate(
    req.user._id, 
    {
      $set:{
        refreshToken:undefined
        
      },
  } , 
  {
    new : true,
  }
  )

  console.log(user._id, user.refreshToken, user.accessToken)
  const options = {
    httpOnly:true,
    secure:true
  }

  return res
  .status(200)
  .clearCookie("accessToken", options)
  .clearCookie("refreshToken", options)
  .json(new ApiResponse(200, {}, "User logged out successfully"))
})

const refreshAccessToken = asyncHandler(async (req, res) => {
  const inComingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;
  
  if (!inComingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

 try {
   const decodedToken = jwt.verify(inComingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
 
   const user = User.findById(decodedToken?._id);
 
   if(!user){
     throw new ApiError(401, "Invalid refresh token")
   }
 
   if(inComingRefreshToken !== user?.refreshToken){
     throw new ApiError(401, "Refresh token is expired or used")
   }
 
   const options = {
     httpOnly:true,
     secure:true
   }
 
  const {accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(user?._id);
 
  return res
  .status(200)
  .cookie("accessToken", accessToken, options)
  .cookie("refreshToken", newRefreshToken, options)
  .json(
   new ApiResponse(
     200,
     {accessToken,refreshToken:newRefreshToken},
     'Access token refreshed'
   )
  )
 } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
 }

})

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const {oldPassword, newPassword} = req.body;
  const user = await User.findById(req.user?._id);
  const isPassswordCorrect = await user.isPasswordCorrect(oldPassword);

  if(!isPassswordCorrect){
    throw new ApiError(400, "Invalid old password");
  }

  user.password = newPassword;
  await user.save({validateBeforeSave: false});

  return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully"))()
})

const getCurrentUser = asyncHandler(async (req, res) => { 
  return res.status(200).json(new ApiResponse(200, req.user, "Current user fetched successfully"))()
})

const updateAccountDetails = asyncHandler(async (req, res) => {
  const {fullName, email} = req.body;
  if(!fullName && !email){
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(req.user?._id, {
    $set:{
      fullName,
      email
    }
  }, {new:true}).select("-password")

  res
  .status(200)
  .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {

  const avatarLocalPath = req.file?.path;
  if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if(!avatar){
    throw new ApiError(400, "Error while uploading on avatar");
  }

 const user =  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar:avatar.url
      }
      
    },
    {user:true}
  ).select("-password")
  
  return res
  .status(200)
  .json(new ApiResponse(200, user, "Avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler(async (req, res) => {

  const coverImageLocalPath = req.file?.path;
  if(!coverImageLocalPath){
    throw new ApiError(400, "coverImage file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if(!coverImage){
    throw new ApiError(400, "Error while uploading on coverImage");
  }

 const user =  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar:coverImage.url
      }
      
    },
    {user:true}
  ).select("-password")
  
  return res
  .status(200)
  .json(new ApiResponse(200, user, "coverImage updated successfully"))
})



export { registerUser, 
        loginUser,
        logoutUser,
        refreshAccessToken,
        changeCurrentPassword,
        getCurrentUser,
        updateAccountDetails,
        updateUserAvatar,
        updateUserCoverImage
};
