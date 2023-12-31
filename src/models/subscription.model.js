import mongoose, {Schema} from "mongoose";

const subscriptionSchema = new Schema({
    subscriber : {
        type:Schema.Types.ObjectId,  // one who subcribing
        ref:"User"
    },
    channel : {
        type:Schema.Types.ObjectId,  // one who whom 'subscriber is sucribing
        ref:"User"
    }
}, {
    timestamps:true
});

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
