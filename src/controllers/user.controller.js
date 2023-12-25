import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";


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
  console.log(fullName, email, username, password);

  if (
    [fullName, email.username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "Please fill all the fields");
  }

  // check is user already user existes
  const existedUser = User.findOne({
    $or:[{ email }, { username }]
  })

  if(existedUser){
    throw new ApiError(409, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  const coverImageLocalPath = req.files?.covarImage[0]?.path;

  if(!avatarLocalPath){
    throw new ApiError(400, "Please upload avatar");
  }

  //  Upload Imges fiels to Cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if(!avatar){
    throw new ApiError(400, "Please upload avatar");
  }

  const user = await User.create({
    fullName,
    avatar : avatar.url,
    coverImage : coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(), 
  });

  const createdUser = user.findById(user._id).select(
    "-password -refreshToken"
  )

  if(!createdUser){
    throw new ApiError(500, "Spmething went wrong while registering the user ");
  }
  
  return res.status(201).json(new ApiResponse(200,createdUser, "User registered successfully" ))

});

export { registerUser };
