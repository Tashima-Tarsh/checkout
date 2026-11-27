# Development Environment Configuration
terraform {
  backend "s3" {
    bucket         = "disha8-2-tfstate"
    key            = "infrastructure/dev/terraform.tfstate"
    region         = "ap-southeast-2"
    encrypt        = true
    dynamodb_table = "disha8-2-terraform-lock"
  }
}

variable "environment" {
  default = "development"
}

variable "aws_region" {
  default = "ap-southeast-2"
}

variable "vpc_cidr" {
  default = "10.1.0.0/16"
}

variable "public_subnet_cidrs" {
  default = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
}

variable "private_subnet_cidrs" {
  default = ["10.1.10.0/24", "10.1.11.0/24", "10.1.12.0/24"]
}

variable "db_subnet_cidrs" {
  default = ["10.1.20.0/24", "10.1.21.0/24", "10.1.22.0/24"]
}

variable "ecs_task_cpu" {
  default = 0.25
}

variable "ecs_task_memory" {
  default = 512
}

variable "ecs_min_tasks" {
  default = 1
}

variable "ecs_max_tasks" {
  default = 2
}

variable "rds_instance_class" {
  default = "db.t3.micro"
}

variable "rds_allocated_storage" {
  default = 20
}

variable "rds_multi_az" {
  default = false
}

variable "redis_node_type" {
  default = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  default = 1
}

variable "rds_multi_az" {
  default = false
}

enable_multi_az = false
