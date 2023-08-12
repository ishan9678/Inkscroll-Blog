// packages
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
var _ = require("lodash");
var multer = require("multer");
var session = require("express-session");
var passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const mongoose = require("mongoose");

const app = express();

app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(
  "mongodb+srv://is9678:0t240Cmu1v6LjgyU@cluster0.gepmonk.mongodb.net/blogDB"
);

const upload = multer();

const blogPostSchema = new mongoose.Schema({
  title: String,
  content: String,
  image: { type: Buffer },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  likes: {
    type: Number,
    default: 0,
  },
  comments: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      content: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  email: String,
  password: String,
});

userSchema.plugin(passportLocalMongoose);

const Post = mongoose.model("Post", blogPostSchema);
const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());

passport.deserializeUser(User.deserializeUser());

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// get
app.get("/", (req, res) => {
  res.render("landing");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/home", async (req, res) => {
  try {
    const posts = await Post.find({}).populate("user"); // Populate the 'user' field with the actual user data

    res.render("home", {
      posts: posts,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/login");
  }
});

app.get("/profile", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const loggedUserId = req.user._id;
      const foundUser = await User.findById(loggedUserId);
      const userPosts = await Post.find({ user: loggedUserId }).sort({
        createdAt: -1,
      });

      // Calculate the totalLikes
      let totalLikes = 0;
      userPosts.forEach((post) => {
        totalLikes += post.likes;
      });

      if (foundUser) {
        res.render("profile", {
          user: foundUser,
          userPosts: userPosts,
          totalLikes: totalLikes,
          totalPosts: userPosts.length,
          isOwnProfile: true, // Add a flag to indicate that this is the user's own profile
        });
      } else {
        res.send("User not found");
      }
    } catch (err) {
      console.log(err);
      res.redirect("/");
    }
  } else {
    res.redirect("/login");
  }
});


app.get("/compose", (req, res) => {
  res.render("compose");
});

app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
    }
    res.redirect("/");
  });
});

app.get("/posts/:encodedTitle", async (req, res) => {
  const requestedEncodedTitle = req.params.encodedTitle;
  const requestedTitle = requestedEncodedTitle.replace(/-/g, ' ');

  try {
    const post = await Post.findOne({ title: requestedTitle })
      .populate("user", "username")
      .populate("comments.user", "username")
      .exec();

    if (!post) {
      return res.send("Post not found");
    }

    res.render("post", {
      title: post.title,
      content: post.content,
      image: post.image,
      user: post.user,
      likes: post.likes,
      createdAt: post.createdAt,
      _id: post._id,
      comments: post.comments,
    });
  } catch (err) {
    console.log(err);
    res.redirect("/home");
  }
});


app.get("/user/:userId", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const userId = req.params.userId;
      const foundUser = await User.findById(userId);
      const userPosts = await Post.find({ user: userId }).sort({
        createdAt: -1,
      });

      // Calculate the totalLikes
      let totalLikes = 0;
      userPosts.forEach((post) => {
        totalLikes += post.likes;
      });


      if (foundUser) {
        res.render("profile", {
          user: foundUser,
          userPosts: userPosts,
          totalLikes: totalLikes,
          totalPosts: userPosts.length,
          isOwnProfile: req.user._id.toString() === userId, // Check if it's the logged-in user's own profile
        });
      } else {
        res.send("User not found");
      }
    } catch (err) {
      console.log(err);
      res.redirect("/");
    }
  } else {
    res.redirect("/login");
  }
});

app.get("/profile/:userId", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const userId = req.params.userId;
      const foundUser = await User.findById(userId);
      const userPosts = await Post.find({ user: userId }).sort({
        createdAt: -1,
      });

      // Calculate the totalLikes
      let totalLikes = 0;
      userPosts.forEach((post) => {
        totalLikes += post.likes;
      });


      if (foundUser) {
        res.render("profile", {
          user: foundUser,
          userPosts: userPosts,
          totalLikes: totalLikes,
          totalPosts: userPosts.length,
          isOwnProfile: req.user._id.toString() === userId, // Check if it's the logged-in user's own profile
        });
      } else {
        res.send("User not found");
      }
    } catch (err) {
      console.log(err);
      res.redirect("/");
    }
  } else {
    res.redirect("/login");
  }
});


// Add a new route for searching posts by title
app.get("/search", async (req, res) => {
  const searchQuery = req.query.q; // Get the search query from the URL parameter

  try {
    // Use a regular expression to perform a case-insensitive search for posts
    const posts = await Post.find({
      title: { $regex: searchQuery, $options: "i" },
    }).populate("user");
    res.render("search", { posts: posts, searchQuery: searchQuery });
  } catch (err) {
    console.log(err);
    res.redirect("/home");
  }
});

// post
app.post("/register", (req, res) => {
  const newUser = new User({
    name: req.body.name,
    username: req.body.username,
    email: req.body.mail,
  });

  User.register(newUser, req.body.password, function (err, user) {
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/home");
      });
    }
  });
});

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/home");
      });
    }
  });
});

app.post("/compose", upload.single("image"), async (req, res) => {
  if (!req.isAuthenticated()) {
    console.log("we compose");
    return res.redirect("/login");
  }
  const blogPost = new Post({
    title: req.body.title,
    content: req.body.post,
    image: req.file ? req.file.buffer : undefined,
    user: req.user._id,
  });

  try {
    await blogPost.save();
    res.redirect("/home");
  } catch (err) {
    console.log(err);
    res.redirect("/compose");
  }
});

app.post("/like/:postId", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/login");
  }

  const postId = req.params.postId;

  try {
    // Find the post by ID and update the likes count
    const post = await Post.findById(postId);
    post.likes += 1;
    await post.save();

    // Redirect back to the same post after liking
    res.redirect(`/posts/${post.title}`);
  } catch (err) {
    console.log(err);
    res.redirect("/home");
  }
});

app.post("/posts/:postId/comments", async (req, res) => {
  if (!req.isAuthenticated()) {
    console.log("we post");
    return res.redirect("/login");
  }

  const postId = req.params.postId;
  const commentContent = req.body.comment;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.redirect("/home");
    }

    const newComment = {
      user: req.user._id,
      content: commentContent,
    };

    post.comments.push(newComment);
    await post.save();

    res.redirect(`/posts/${post.title}`);
  } catch (err) {
    console.log(err);
    res.redirect("/home");
  }
});

app.listen(3000, function () {
  console.log("Server started on port 3000");
});
