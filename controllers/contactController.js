const { Op } = require('sequelize');
const Contact = require('../models/contact');
const sequelize = require('../config/sequelize');

exports.identifyContact = async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: 'Email or phoneNumber is required' });
  }

  await sequelize.sync();


  let matchingContacts = await Contact.findAll({
    where: {
      [Op.or]: [
        { email: email || null },
        { phoneNumber: phoneNumber || null }
      ]
    },
    order: [['createdAt', 'ASC']]
  });

  
  if (matchingContacts.length === 0) {
    const newPrimary = await Contact.create({
      email,
      phoneNumber,
      linkPrecedence: 'primary'
    });

    return res.status(200).json({
      contact: {
        primaryContatctId: newPrimary.id,
        emails: [newPrimary.email].filter(Boolean),
        phoneNumbers: [newPrimary.phoneNumber].filter(Boolean),
        secondaryContactIds: []
      }
    });
  }


  const contactIds = new Set(matchingContacts.map(c => c.id));
  const linkedIds = matchingContacts.map(c => c.linkedId).filter(Boolean);
  const rootIds = [...contactIds, ...linkedIds];

  const allRelatedContacts = await Contact.findAll({
    where: {
      [Op.or]: [
        { id: { [Op.in]: rootIds } },
        { linkedId: { [Op.in]: rootIds } }
      ]
    },
    order: [['createdAt', 'ASC']]
  });


  const primaryContact = allRelatedContacts.find(c => c.linkPrecedence === 'primary');


  for (const c of allRelatedContacts) {
    if (c.linkPrecedence === 'primary' && c.id !== primaryContact.id) {
      c.linkPrecedence = 'secondary';
      c.linkedId = primaryContact.id;
      await c.save();
    }
  }


  const alreadyExists = allRelatedContacts.some(
    c => c.email === email && c.phoneNumber === phoneNumber
  );

  const isNewEmail = email && !allRelatedContacts.some(c => c.email === email);
  const isNewPhone = phoneNumber && !allRelatedContacts.some(c => c.phoneNumber === phoneNumber);

  if (!alreadyExists && (isNewEmail || isNewPhone)) {
    await Contact.create({
      email,
      phoneNumber,
      linkedId: primaryContact.id,
      linkPrecedence: 'secondary'
    });
  }


  const finalContacts = await Contact.findAll({
    where: {
      [Op.or]: [
        { id: primaryContact.id },
        { linkedId: primaryContact.id }
      ]
    },
    order: [['createdAt', 'ASC']]
  });


  const emails = [];
  const phoneNumbers = [];
  const secondaryIds = [];

  for (const c of finalContacts) {
    if (c.email && !emails.includes(c.email)) emails.push(c.email);
    if (c.phoneNumber && !phoneNumbers.includes(c.phoneNumber)) phoneNumbers.push(c.phoneNumber);
    if (c.linkPrecedence === 'secondary') secondaryIds.push(c.id);
  }

  return res.status(200).json({
    contact: {
      primaryContatctId: primaryContact.id,
      emails,
      phoneNumbers,
      secondaryContactIds: secondaryIds
    }
  });
};
