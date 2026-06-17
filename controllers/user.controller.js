import bcrypt from 'bcrypt';
import User from '../models/user.model.js'; 
import { Op } from 'sequelize';
import { generateToken } from '../middlewares/auth.js';

const registerUser = async (req, res) => {
  const { email,password} = req.body;
  
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: {
        [Op.or]: [
          { email },
        ]
      }
    });
    if (existingUser) {
      return res.status(400).send({ message: 'User already exists' });
    }

   
    const hash = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({ 
      email,  
      password: hash,
     
    });

    res.status(201).send({ 
      message: 'User registered Successfully.',
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred!! ${error}` });
  }
};



const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).send({ message: 'User not found' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).send({ message: 'Invalid login credentials' });
    }

    const payload = { userId: user.user_id };
    const token = generateToken(payload);
    res.cookie('token', token, {
      httpOnly: true,
        secure: true,        // ← Required: cookie only sent over HTTPS
  sameSite: 'none', 
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });
   
    res.status(200).json({ message: 'Login successful'});
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: `An error occurred while logging in ${error}` });
  }
};

export const userController = {
  loginUser,
  registerUser
};