-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='TRADITIONAL,ALLOW_INVALID_DATES';

-- -----------------------------------------------------
-- Schema discord_bot_db
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema discord_bot_db
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `discord_bot_db` DEFAULT CHARACTER SET utf8 ;
USE `discord_bot_db` ;

-- -----------------------------------------------------
-- Table `discord_bot_db`.`groups`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `discord_bot_db`.`groups` ;

CREATE TABLE IF NOT EXISTS `discord_bot_db`.`groups` (
  `group_id` INT NOT NULL AUTO_INCREMENT,
  `group_name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`group_id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `discord_bot_db`.`commands`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `discord_bot_db`.`commands` ;

CREATE TABLE IF NOT EXISTS `discord_bot_db`.`commands` (
  `command_id` INT NOT NULL AUTO_INCREMENT,
  `command_name` VARCHAR(100) NOT NULL,
  `command_help` VARCHAR(500) NOT NULL,
  `command_template` VARCHAR(500) NOT NULL,
  `groups_group_id` INT NOT NULL,
  `function_name` VARCHAR(50) NOT NULL,
  `needPerm` TINYINT NULL DEFAULT 0,
  PRIMARY KEY (`command_id`, `groups_group_id`),
  INDEX `fk_commands_groups_idx` (`groups_group_id` ASC),
  CONSTRAINT `fk_commands_groups`
    FOREIGN KEY (`groups_group_id`)
    REFERENCES `discord_bot_db`.`groups` (`group_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `discord_bot_db`.`guilds`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `discord_bot_db`.`guilds` ;

CREATE TABLE IF NOT EXISTS `discord_bot_db`.`guilds` (
  `guild_discord_id` VARCHAR(50) NOT NULL,
  `guild_name` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`guild_discord_id`))
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `discord_bot_db`.`quiz_questions`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `discord_bot_db`.`quiz_questions` ;

CREATE TABLE IF NOT EXISTS `discord_bot_db`.`quiz_questions` (
  `question_id` INT NOT NULL AUTO_INCREMENT,
  `question` VARCHAR(1000) NOT NULL,
  `answers` VARCHAR(1000) NULL,
  `amount_of_points` INT NULL DEFAULT 1,
  `time` INT NULL DEFAULT 30,
  `time_before_next` INT NULL DEFAULT 0,
  `correct_answer` INT NULL,
  `guilds_guild_discord_id` VARCHAR(50) NOT NULL,
  `guild_question_id` INT NOT NULL,
  PRIMARY KEY (`question_id`, `guilds_guild_discord_id`),
  INDEX `fk_quiz_questions_guilds1_idx` (`guilds_guild_discord_id` ASC),
  CONSTRAINT `fk_quiz_questions_guilds1`
    FOREIGN KEY (`guilds_guild_discord_id`)
    REFERENCES `discord_bot_db`.`guilds` (`guild_discord_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `discord_bot_db`.`guild_groups`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `discord_bot_db`.`guild_groups` ;

CREATE TABLE IF NOT EXISTS `discord_bot_db`.`guild_groups` (
  `group_id` INT NOT NULL,
  `group_name` VARCHAR(100) NOT NULL,
  `guilds_guild_discord_id` VARCHAR(50) NOT NULL,
  `role_id` VARCHAR(50) NOT NULL,
  `role_color` VARCHAR(50) NULL,
  `channel_id` VARCHAR(50) NULL,
  PRIMARY KEY (`group_id`, `group_name`, `guilds_guild_discord_id`),
  INDEX `fk_guild_groups_guilds1_idx` (`guilds_guild_discord_id` ASC),
  CONSTRAINT `fk_guild_groups_guilds1`
    FOREIGN KEY (`guilds_guild_discord_id`)
    REFERENCES `discord_bot_db`.`guilds` (`guild_discord_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table `discord_bot_db`.`guild_group_members`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `discord_bot_db`.`guild_group_members` ;

CREATE TABLE IF NOT EXISTS `discord_bot_db`.`guild_group_members` (
  `member_id` VARCHAR(50) NOT NULL,
  `isLeader` TINYINT NULL DEFAULT 0,
  `guild_groups_group_id` INT NOT NULL,
  `guild_groups_group_name` VARCHAR(100) NOT NULL,
  `guild_groups_guilds_guild_discord_id` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`member_id`, `guild_groups_group_id`, `guild_groups_group_name`, `guild_groups_guilds_guild_discord_id`),
  INDEX `fk_guild_group_members_guild_groups1_idx` (`guild_groups_group_id` ASC, `guild_groups_group_name` ASC, `guild_groups_guilds_guild_discord_id` ASC),
  CONSTRAINT `fk_guild_group_members_guild_groups1`
    FOREIGN KEY (`guild_groups_group_id` , `guild_groups_group_name` , `guild_groups_guilds_guild_discord_id`)
    REFERENCES `discord_bot_db`.`guild_groups` (`group_id` , `group_name` , `guilds_guild_discord_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE)
ENGINE = InnoDB;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;






use discord_bot_db;
insert into groups(group_name) values('main');
insert into groups(group_name) values('quiz');
insert into groups(group_name) values('group');

insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('ping','Pong!\n','ping','pingFunc',1);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('help','Get a list of all available commands (DM)\n','help','helpFunc',1);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id, needPerm)
values('addQuestionDM','Add a question to the quiz using DM\'s\n','quiz addQuestionDM'
,'addQuestionDMFunc',2,1);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('create','Create a group to add people to\n','group create {OPTIONAL: hex role color: ex. #03fcfc} (name of group) ', 'createFunc',3);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('changeName','Change the name of your group (have to be the leader)\n','group changeName (new name)','changeNameFunc',3);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('changeRoleColor','Change the color of your grouprole (have to be the leader)\n','group changeRoleColor (new color)','changeColorFunc',3);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('invite','Invite a member to your group (have to be the leader and member has to not be in a group)\n','group invite (@mention of user)','inviteFunc',3);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('kick','Kick a member from your group (have to be the leader)\n','group kick (@mention of user)','kickFunc',3);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('delete','Delete your group (have to be the leader)\n','group delete','deleteFunc',3);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('changeLeader','Make another member of your group leader (have to be the leader)\n','group changeLeader (@mention of user)','changeLeaderFunc',3);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id,needPerm)
values('makeChannels','Make a channel for every group or a specific group\n','group makeChannel (name of channel or empty for all)','makeChannelFunc',3,1);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id,needPerm)
values('deleteChannels','Delete a channel for every group or a specific group\n','group deleteChannels (name of channel or empty for all)','deleteChannelFunc',3,1);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id,needPerm)
values('addQuestions','Add a question to the quiz using a CSV file.\n','quiz addQuestions'
,'addQuestionFunc',2,1);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id,needPerm)
values('exportToExcel','Export all questions to an Excel file (will be DM\'ed).\n','quiz exportToExcel'
,'exportFunc',2,1);
insert into commands(command_name,command_help,command_template,function_name,groups_group_id)
values('kick','Kick a member from your group (have to be the leader)\n','group kick (@mention of user)','kickFunc',3);
insert into commands(command_name, command_help, command_template, function_name, groups_group_id, needPerm)
values('shuffleVoice','Shuffle members into the designated voice channels (users should already be in a voice channel)\nArguments:\n`-c`: name of voice channels (ex: `-c group_1 group_2`)\n`-m`: mentioned members, can be a rolementions, member mentions or @everyone)\n','shuffleVoice -c (channels) -m (mention)','shuffleVoiceFunc',1,1);

